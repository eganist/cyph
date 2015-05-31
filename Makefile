all:
	./docker.sh restart
	docker build -t cyph/$$(git describe --tags --exact-match 2> /dev/null || git branch | awk '/^\*/{print $$2}') .

clean:
	./docker.sh restart
	docker images | grep cyph | awk '{print $$3}' | xargs -I% docker rmi -f %
	docker images --filter dangling=true --quiet | xargs -I% docker rmi -f %
